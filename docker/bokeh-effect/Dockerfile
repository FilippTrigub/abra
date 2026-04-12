FROM filipptri/abra-base:latest

RUN pip install --no-cache-dir \
    "torchvision>=0.1" \
    "timm>=0.9" \
    opencv-python-headless

COPY lib/runpod/ lib/runpod/
COPY skills/_providers/ skills/_providers/
COPY skills/bokeh-effect/ skills/bokeh-effect/

CMD ["python", "skills/bokeh-effect/runpod_handler.py"]
