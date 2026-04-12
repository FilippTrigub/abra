FROM filipptri/abra-base:latest

RUN pip install --no-cache-dir "rembg[gpu]>=2.0"

COPY lib/runpod/ lib/runpod/
COPY skills/_providers/ skills/_providers/
COPY skills/video-matte/ skills/video-matte/

CMD ["python", "skills/video-matte/runpod_handler.py"]
