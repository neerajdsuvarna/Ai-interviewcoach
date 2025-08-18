from setuptools import setup, find_packages

setup(
    name="TTS",
    version="0.22.0",
    packages=find_packages(include=["TTS", "TTS.*"]),  # Includes all TTS submodules
    install_requires=[
        "numpy>=1.22.0",
        "scipy>=1.11.2",
        "torch>=2.1",
        "torchaudio>=2.1",
        "soundfile>=0.12.0",
        "librosa>=0.10.0",
        "scikit-learn>=1.3.0",
        "numba>=0.57.0",
        "tqdm>=4.64.1",
        "pyyaml>=6.0",
        "fsspec>=2023.6.0",  # Ensuring compatibility with aux tests
        "packaging>=23.1",
        "matplotlib>=3.7.0",
        "trainer>=0.0.36",
        "coqpit>=0.0.16",
        "einops>=0.6.0",
        "transformers>=4.33.0",
        "spacy[ja]>=3"
    ],
    python_requires=">=3.9, <3.12",  # Restricting for compatibility
)
