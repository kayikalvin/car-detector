FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (only glib, no OpenGL needed)
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (prevents pulling CUDA later)
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.4.0 torchvision==0.19.0

# Now install the rest of the requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the whole project
COPY . .

EXPOSE 8000


# Start the server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
