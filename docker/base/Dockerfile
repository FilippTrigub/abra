FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# System deps common to all skills
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Python deps common to all skills
RUN pip install --no-cache-dir \
    runpod \
    b2sdk \
    pillow \
    numpy \
    ffmpeg-python

# Redirect all ML library caches to the shared Network Volume.
# The volume persists across workers so models are downloaded once, not per cold start.
ENV RUNPOD_MODELS_PATH=/runpod-volume/models \
    # HuggingFace (transformers, diffusers, tokenizers)
    HF_HOME=/runpod-volume/models/huggingface \
    # PyTorch hub (torch.hub.load) and torchvision pretrained weights
    TORCH_HOME=/runpod-volume/models/torch \
    # rembg ONNX models
    U2NET_HOME=/runpod-volume/models/u2net \
    # Demucs models (also uses TORCH_HOME, but set explicitly for clarity)
    DEMUCS_HOME=/runpod-volume/models/demucs
