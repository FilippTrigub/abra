FROM filipptri/abra-base:latest

RUN pip install --no-cache-dir "rembg[gpu]>=2.0"

COPY lib/runpod/ lib/runpod/
COPY skills/_providers/ skills/_providers/
COPY skills/background-remover/ skills/background-remover/

CMD ["python", "skills/background-remover/runpod_handler.py"]
