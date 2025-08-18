import os
import json
from uvr.separator import Separator
from pydub import AudioSegment, effects
from pydub.silence import detect_nonsilent
from common.config import AUDIO_SEPARATOR_MODELS_PATH 

def get_unique_filename(base_path, ext):
    """
    Generate a unique filename if the file already exists.
    """
    counter = 1
    output_path = f"{base_path}{ext}"
    while os.path.exists(output_path):
        output_path = f"{base_path}_{counter}{ext}"
        counter += 1
    return output_path

def enhance_audio(input_path, output_dir, silence_thresh=-40, min_silence_len=500, target_dBFS=-20, fade_duration=200, min_audio_dBFS=-35):
    """
    Enhances an audio file by:
    - Removing silent parts
    - Normalizing volume
    - Applying a fade-in and fade-out effect
    - Converting output to WAV format
    - Filtering out audio below a certain volume threshold
    
    :param input_path: Path to input audio file
    :param output_dir: Directory to save the enhanced audio
    :param silence_thresh: Silence threshold in dBFS (default: -40dBFS)
    :param min_silence_len: Minimum silence duration in ms to consider as silence (default: 500ms)
    :param target_dBFS: Target volume level for normalization (default: -20dBFS)
    :param fade_duration: Duration of fade-in and fade-out effects in ms (default: 200ms)
    :param min_audio_dBFS: Minimum average volume level (in dBFS) required to process audio (default: -35dBFS)
    """
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Load audio file
    audio = AudioSegment.from_file(input_path)
    
    # Check if the audio is above the minimum volume threshold
    if audio.dBFS < min_audio_dBFS:
        print(f"Skipping {input_path}: Audio volume below {min_audio_dBFS} dBFS.")
        return None
    
    # Detect non-silent chunks
    nonsilent_chunks = detect_nonsilent(audio, min_silence_len=min_silence_len, silence_thresh=silence_thresh)
    
    # Extract and concatenate non-silent parts
    if nonsilent_chunks:
        processed_audio = AudioSegment.silent(duration=0)
        for start, end in nonsilent_chunks:
            processed_audio += audio[start:end]
    else:
        print("Warning: No non-silent audio detected.")
        return None
    
    # Normalize volume
    change_in_dBFS = target_dBFS - processed_audio.dBFS
    normalized_audio = processed_audio.apply_gain(change_in_dBFS)
    
    # Apply fade-in and fade-out
    faded_audio = normalized_audio.fade_in(fade_duration).fade_out(fade_duration)
    
    # Construct output filename
    input_filename = os.path.splitext(os.path.basename(input_path))[0]
    output_base = os.path.join(output_dir, f"{input_filename}_enhanced")
    output_path = get_unique_filename(output_base, ".wav")
    
    # Export processed audio
    faded_audio.export(output_path, format="wav")
    return output_path

def process_audio(
    audio_file: str,
    model_filename="model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt",
    output_format="WAV",
    output_dir=None,
    model_file_dir=AUDIO_SEPARATOR_MODELS_PATH,
    invert_spect=False,
    normalization=0.9,
    single_stem=None,
    sample_rate=44100,
    mdx_params=None,
    vr_params=None,
    demucs_params=None,
    mdxc_params=None,
    list_models=False,
):
    model_path = os.path.join(model_file_dir, model_filename)
    if not os.path.exists(model_path):
        print(f" Error: Model file '{model_filename}' not found in '{model_file_dir}'.")
        print("➡️  Please download and place the model file in the correct folder before proceeding.")
        return None
    """
    Process an audio file and separate it into stems.
    """
    # Initialize separator
    separator = Separator(
        model_file_dir=model_file_dir,
        output_dir=output_dir,
        output_format=output_format,
        normalization_threshold=normalization,
        output_single_stem=single_stem,
        invert_using_spec=invert_spect,
        sample_rate=sample_rate,
        mdx_params=mdx_params or {
            "hop_length": 1024,
            "segment_size": 256,
            "overlap": 0.25,
            "batch_size": 1,
            "enable_denoise": False,
        },
        vr_params=vr_params or {
            "batch_size": 4,
            "window_size": 512,
            "aggression": 5,
            "enable_tta": False,
            "enable_post_process": False,
            "post_process_threshold": 0.2,
            "high_end_process": False,
        },
        demucs_params=demucs_params or {
            "segment_size": "Default",
            "shifts": 2,
            "overlap": 0.25,
            "segments_enabled": True,
        },
        mdxc_params=mdxc_params or {
            "segment_size": 256,
            "batch_size": 1,
            "overlap": 8,
            "override_model_segment_size": False,
            "pitch_shift": 0,
        },
    )
    
    print(f"Separator is using device: {separator.torch_device}")


    if list_models:
        return json.dumps(separator.list_supported_model_files(), indent=4, sort_keys=True)

    # Ensure an audio file is provided
    if not audio_file:
        raise ValueError("No audio file provided for processing.")

    # Load model
    separator.load_model(model_filename=model_filename)

    # Perform audio separation
    output_files = separator.separate(audio_file)
    print(f"Output files: {output_files}")

    # If output files were created, use the correct stem file
    if output_files:
        # We are now assuming the separated file is created directly based on the stem name
        separated_file = None
        
        # Directly use the name of the separated file (e.g., Vocals)
        target_stem = single_stem if single_stem else "Vocals"  # You can specify 'Vocals' or any other stem you need
        
        for file in output_files:
            if target_stem.lower() in file.lower():  # Matching by the stem name
                separated_file = file
                break
        
        if separated_file:
            # Get the full path to the separated file
            separated_file_path = os.path.join(output_dir, separated_file)
            
            # Pass the separated file directly to the enhance_audio function
            enhanced_file = enhance_audio(separated_file_path, output_dir)
            
            if enhanced_file:
                # Delete the separated file after enhancement
                if os.path.exists(separated_file_path):
                    os.remove(separated_file_path)
                    # print(f"Deleted separated file: {separated_file_path}")
            
            return enhanced_file  # Return the path of the enhanced file
        else:
            print(f"Error: {target_stem} file not found in the output.")
            return []
    
    return output_files


# 
# ... (all your existing functions)

if __name__ == "__main__":
    # Example usage: only executed when running this file directly.
    enhanced_file = process_audio(
        audio_file=r"C:\Users\neera\OneDrive\Desktop\PROJECT\my_dataset\maroon.mp3",
        output_dir=r"C:\Users\neera\OneDrive\Desktop\PROJECT\my_dataset",
        single_stem="Vocals",  # You can change to "Drums", "Bass", etc.
        # list_models=True,  # Uncomment to list available models
    )
    print(f"Enhanced file saved to: {enhanced_file}")

