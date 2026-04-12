FROM filipptri/abra-base:latest

RUN pip install --no-cache-dir "demucs>=4.0"

COPY lib/runpod/ lib/runpod/
COPY skills/_providers/ skills/_providers/
COPY skills/audio-splitter/ skills/audio-splitter/

CMD ["python", "skills/audio-splitter/runpod_handler.py"]
