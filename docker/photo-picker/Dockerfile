FROM filipptri/abra-base:latest

RUN pip install --no-cache-dir "transformers>=4.40"

COPY lib/runpod/ lib/runpod/
COPY skills/_providers/ skills/_providers/
COPY skills/photo-picker/ skills/photo-picker/

CMD ["python", "skills/photo-picker/runpod_handler.py"]
