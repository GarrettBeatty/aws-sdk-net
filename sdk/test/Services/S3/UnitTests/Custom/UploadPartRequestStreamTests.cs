/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
using Amazon;
using Amazon.Runtime;
using Amazon.Runtime.Internal;
using Amazon.Runtime.Internal.Auth;
using Amazon.Runtime.Internal.Transform;
using Amazon.Runtime.Internal.Util;
using Amazon.S3;
using Amazon.S3.Internal;
using Amazon.S3.Model;
using Amazon.S3.Model.Internal.MarshallTransformations;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System;
using System.IO;
using System.Text;

namespace AWSSDK.UnitTests
{
    [TestClass]
    public class UploadPartRequestStreamTests
    {
        private AmazonS3Config s3Config;

        [TestInitialize]
        public void Initialize()
        {
            s3Config = new AmazonS3Config
            {
                RegionEndpoint = RegionEndpoint.USEast1
            };
        }

        /// <summary>
        /// Test stream that simulates a nonseekable stream
        /// </summary>
        private class NonSeekableStream : MemoryStream
        {
            private readonly byte[] _data;
            private int _position = 0;

            public NonSeekableStream(byte[] data) : base()
            {
                _data = data;
            }

            public override bool CanSeek => false;
            public override bool CanRead => true;
            public override bool CanWrite => false;

            public override long Length => throw new NotSupportedException("Length is not supported for nonseekable stream");
            public override long Position 
            { 
                get => throw new NotSupportedException("Position is not supported for nonseekable stream");
                set => throw new NotSupportedException("Position is not supported for nonseekable stream");
            }

            public override long Seek(long offset, SeekOrigin origin)
            {
                throw new NotSupportedException("Seek is not supported for nonseekable stream");
            }

            public override int Read(byte[] buffer, int offset, int count)
            {
                int bytesToRead = Math.Min(count, _data.Length - _position);
                if (bytesToRead <= 0) return 0;

                Array.Copy(_data, _position, buffer, offset, bytesToRead);
                _position += bytesToRead;
                return bytesToRead;
            }

            public override void SetLength(long value)
            {
                throw new NotSupportedException("SetLength is not supported for nonseekable stream");
            }

            public override void Write(byte[] buffer, int offset, int count)
            {
                throw new NotSupportedException("Write is not supported for nonseekable stream");
            }
        }

        [TestMethod]
        [TestCategory("S3")]
        public void TestUploadPartRequest_DisablePartialWrapperStream_WithNonSeekableStream()
        {
            // Arrange
            byte[] testData = Encoding.UTF8.GetBytes("This is test data for the upload part request");
            var nonSeekableStream = new NonSeekableStream(testData);
            
            var request = new UploadPartRequest
            {
                BucketName = "test-bucket",
                Key = "test-key",
                UploadId = "test-upload-id",
                PartNumber = 1,
                PartSize = testData.Length,
                InputStream = nonSeekableStream,
                DisablePartialWrapperStream = true,
                DisablePayloadSigning = true
            };

            // Act & Assert - should not throw an exception
            var iRequest = ProcessUploadPartRequest(request);
            
            // Verify the content length header is set correctly
            Assert.IsTrue(iRequest.Headers.ContainsKey("Content-Length"));
            Assert.AreEqual(testData.Length.ToString(), iRequest.Headers["Content-Length"]);
            
            // Verify the stream is the original nonseekable stream, not wrapped
            Assert.AreSame(nonSeekableStream, iRequest.ContentStream);
        }

        [TestMethod]
        [TestCategory("S3")]
        public void TestUploadPartRequest_DisablePartialWrapperStream_WithoutPartSize_ThrowsException()
        {
            // Arrange
            byte[] testData = Encoding.UTF8.GetBytes("This is test data");
            var nonSeekableStream = new NonSeekableStream(testData);
            
            var request = new UploadPartRequest
            {
                BucketName = "test-bucket",
                Key = "test-key",
                UploadId = "test-upload-id",
                PartNumber = 1,
                InputStream = nonSeekableStream,
                DisablePartialWrapperStream = true,
                DisablePayloadSigning = true
                // PartSize not set intentionally
            };

            // Act & Assert
            Assert.ThrowsException<ArgumentException>(() => ProcessUploadPartRequest(request));
        }

        [TestMethod]
        [TestCategory("S3")]
        public void TestUploadPartRequest_DefaultBehavior_WithSeekableStream()
        {
            // Arrange
            byte[] testData = Encoding.UTF8.GetBytes("This is test data for the upload part request");
            var seekableStream = new MemoryStream(testData);
            
            var request = new UploadPartRequest
            {
                BucketName = "test-bucket",
                Key = "test-key",
                UploadId = "test-upload-id",
                PartNumber = 1,
                PartSize = testData.Length,
                InputStream = seekableStream,
                // DisablePartialWrapperStream is false by default
                DisablePayloadSigning = true
            };

            // Act
            var iRequest = ProcessUploadPartRequest(request);
            
            // Assert - stream should be wrapped in PartialWrapperStream
            Assert.IsInstanceOfType(iRequest.ContentStream, typeof(PartialWrapperStream));
            Assert.AreNotSame(seekableStream, iRequest.ContentStream);
        }

        [TestMethod]
        [TestCategory("S3")]
        public void TestUploadPartRequest_DefaultBehavior_WithNonSeekableStream_ThrowsException()
        {
            // Arrange
            byte[] testData = Encoding.UTF8.GetBytes("This is test data");
            var nonSeekableStream = new NonSeekableStream(testData);
            
            var request = new UploadPartRequest
            {
                BucketName = "test-bucket",
                Key = "test-key",
                UploadId = "test-upload-id",
                PartNumber = 1,
                PartSize = testData.Length,
                InputStream = nonSeekableStream,
                // DisablePartialWrapperStream is false by default
                DisablePayloadSigning = true
            };

            // Act & Assert - should throw because PartialWrapperStream requires seekable stream
            Assert.ThrowsException<InvalidOperationException>(() => ProcessUploadPartRequest(request));
        }

        private IRequest ProcessUploadPartRequest(UploadPartRequest request)
        {
            var marshaller = new UploadPartRequestMarshaller();
            var pipeline = new RuntimePipeline(new IPipelineHandler[]
            {
                new AmazonS3AuthSchemeHandler(),
                new Marshaller(),
                new AmazonS3PostMarshallHandler(),
            });

            var requestContext = new RequestContext(s3Config.LogMetrics, new AWS4Signer())
            {
                ClientConfig = s3Config,
                Marshaller = marshaller,
                OriginalRequest = request,
                Unmarshaller = null,
                IsAsync = false
            };
            var executionContext = new ExecutionContext(
                requestContext,
                new ResponseContext()
            );

            pipeline.InvokeSync(executionContext);

            return requestContext.Request;
        }
    }
}