FROM filipptri/abra-base:latest

RUN pip install --no-cache-dir \
    "diffusers>=0.32" \
    "transformers>=4.40" \
    "accelerate>=0.30" \
    sentencepiece \
    ftfy \
    "rembg[cpu]"

COPY lib/runpod/ lib/runpod/
COPY skills/_providers/ skills/_providers/
COPY skills/video-editor/ skills/video-editor/

CMD ["python", "skills/video-editor/runpod_handler.py"]
