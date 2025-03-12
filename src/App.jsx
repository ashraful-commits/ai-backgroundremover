import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as tf from '@tensorflow/tfjs';
import * as bodyPix from '@tensorflow-models/body-pix';
import styled from 'styled-components';
import { Helmet } from 'react-helmet';

// Styled Components
const Loader = styled.div`
  margin-top: 1rem;
  font-size: 1.2rem;
  font-weight: bold;
  color: #007bff;
`;

const Container = styled.div`
  padding: 2rem;
  margin: auto;
  text-align: center;
  background: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
  max-width: 600px;
`;

const DropZone = styled.div`
  border: 2px dashed #007bff;
  border-radius: 12px;
  padding: 2rem;
  margin: 2rem 0;
  cursor: pointer;
  background: ${({ isDragActive }) => (isDragActive ? '#e3f2fd' : 'white')};
  transition: background 0.3s ease;

  &:hover {
    background: #e9ecef;
  }
`;

const ImageContainer = styled.div`
  position: relative;
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const OriginalImage = styled.img`
  max-width: 100%;
  max-height: 500px;
  border-radius: 8px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.2);
  display: ${({ visible }) => (visible ? 'block' : 'none')};
`;

const ProcessedCanvas = styled.canvas`
  max-width: 100%;
  max-height: 500px;
  border-radius: 8px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.2);
  display: ${({ visible }) => (visible ? 'block' : 'none')};
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;

  button {
    padding: 0.6rem 1.2rem;
    font-size: 1rem;
    font-weight: bold;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.3s ease, transform 0.2s ease;

    &:hover {
      background: #0056b3;
      transform: translateY(-2px);
    }

    &:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
  }
`;

function App() {
  const [model, setModel] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [loadingModel, setLoadingModel] = useState(true);
  const [showOriginal, setShowOriginal] = useState(false);
  const canvasRef = useRef(null);

  // Load AI model
  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await bodyPix.load({
          architecture: 'ResNet50',
          outputStride: 32,
          quantBytes: 2
        });
        setModel(loadedModel);
      } catch (error) {
        console.error('Error loading model:', error);
      } finally {
        setLoadingModel(false);
      }
    };
    loadModel();
  }, []);  

  // Drag & Drop
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: 'image/*',
    multiple: false,
    onDrop: files => handleImageUpload(files[0])
  });

  // Resize image before processing
  const resizeImage = (img, maxWidth = 500) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const scale = maxWidth / img.width;
    canvas.width = maxWidth;
    canvas.height = img.height * scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  // Handle Image Upload & Processing
  const handleImageUpload = async file => {
    if (!model || !file) return;
    setProcessing(true);
    try {
      const img = await loadImage(file);
      setImageSrc(img.src);

      // Resize image for better performance
      const resizedCanvas = resizeImage(img);
      const resizedImg = new Image();
      resizedImg.src = resizedCanvas.toDataURL();

      resizedImg.onload = async () => {
        const segmentation = await model.segmentPerson(resizedImg, {
          flipHorizontal: false,
          internalResolution: 'high',
          segmentationThreshold: 0.7
        });
        processImage(resizedImg, segmentation);
      };
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Convert File to Image
  const loadImage = file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Process Image and Remove Background
  const processImage = (img, segmentation) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');

    requestAnimationFrame(() => {
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (!segmentation.data[i / 4]) {
          data[i + 3] = 0; // Make background transparent
        }
      }
      ctx.putImageData(imageData, 0, 0);
    });
  };

  // Reset Image
  const resetImage = () => {
    setImageSrc(null);
    setShowOriginal(false);
  };

  // Download Processed Image
  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'background-removed.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <>
      <Helmet>
        <title>AI Background Remover</title>
        <meta name="description" content="Remove backgrounds from images using AI." />
        <meta name="keywords" content="AI, background removal, image processing, TensorFlow, BodyPix" />
        <meta property="og:title" content="AI Background Remover" />
        <meta property="og:description" content="Remove backgrounds from images using AI." />
        <meta property="og:image" content="link_to_image" />
        <meta property="og:url" content="your_website_url" />
        <meta name="twitter:title" content="AI Background Remover" />
        <meta name="twitter:description" content="Remove backgrounds from images using AI." />
        <meta name="twitter:image" content="link_to_image" />
      </Helmet>
      <Container>
        <h1>AI Background Remover</h1>
        {loadingModel && <Loader>Loading AI model...</Loader>}
        <DropZone {...getRootProps()} isDragActive={isDragActive}>
          <input {...getInputProps()} />
          <p>Drag & drop image, or click to select</p>
          <p>Supported formats: JPEG, PNG</p>
        </DropZone>
        {processing && <Loader>Processing image...</Loader>}
        {imageSrc && (
          <>
            <Controls>
              <button onClick={downloadImage} disabled={processing}>Download</button>
              <button onClick={resetImage}>Reset</button>
              <button onClick={() => setShowOriginal(!showOriginal)}>
                {showOriginal ? 'Show Processed' : 'Show Original'}
              </button>
            </Controls>
            <ImageContainer>
              <OriginalImage src={imageSrc} visible={showOriginal} />
              <ProcessedCanvas ref={canvasRef} visible={!showOriginal} />
            </ImageContainer>
          </>
        )}
      </Container>
    </>
  );
}

export default App;
