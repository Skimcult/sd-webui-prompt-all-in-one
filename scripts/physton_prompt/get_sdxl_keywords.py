import json
import os

sdxl_keywords = {}

DEFAULT_SDXL_KEYWORDS = {
    'lighting': [
        'soft studio light',
        'hard studio light',
        'cinematic rim lighting',
        'cinematic key light',
        'cinematic fill light',
        'golden hour sunlight',
        'blue hour lighting',
        'overcast daylight',
        'direct noon sunlight',
        'sunset backlight',
        'sunrise glow',
        'moonlight',
        'neon night lighting',
        'streetlight glow',
        'volumetric lighting',
        'god rays',
        'subsurface scattering',
        'global illumination',
        'ambient occlusion lighting',
        'high-key lighting',
        'low-key dramatic lighting',
        'split lighting',
        'Rembrandt lighting',
        'butterfly lighting',
        'loop lighting',
        'clamshell lighting',
        'window light',
        'practical lighting',
        'softbox lighting',
        'ring light',
        'colored gel lighting',
        'warm tungsten lighting',
        'cool fluorescent lighting',
        'foggy diffused light',
        'rainy moody lighting',
        'underwater caustic lighting',
    ],
    'camera_type': [
        'DSLR',
        'mirrorless camera',
        'cinema camera',
        'film camera',
        'medium format camera',
        'large format camera',
        'instant camera',
        'action camera',
        'drone camera',
        'smartphone camera',
        'security camera',
        'webcam',
        'thermal camera',
        'infrared camera',
        'depth camera',
        'stereoscopic camera',
        '360 camera',
        'anamorphic lens',
        'wide-angle lens',
        'ultra wide lens',
        'standard 50mm lens',
        'telephoto lens',
        'macro lens',
        'tilt-shift lens',
        'fisheye lens',
    ],
    'frame': [
        'portrait orientation',
        'landscape orientation',
        'square composition',
        'widescreen 16:9',
        'cinematic 2.39:1',
        'vertical 9:16',
        'panoramic composition',
        'rule of thirds',
        'centered composition',
        'symmetrical composition',
        'asymmetrical composition',
        'diagonal composition',
        'triangular composition',
        'golden ratio composition',
        'leading lines',
        'framed within frame',
        'negative space',
        'tight framing',
        'open framing',
        'over-the-shoulder framing',
        'dutch angle framing',
        'headroom preserved',
        'look room preserved',
        'full bleed composition',
    ],
    'shot': [
        'extreme close-up shot',
        'close-up shot',
        'medium close-up shot',
        'medium shot',
        'medium full shot',
        'full body shot',
        'long shot',
        'extreme long shot',
        'wide shot',
        'establishing shot',
        'overhead shot',
        "bird's-eye view shot",
        "worm's-eye view shot",
        'low angle shot',
        'high angle shot',
        'eye-level shot',
        'shoulder-level shot',
        'hip-level shot',
        'knee-level shot',
        'ground-level shot',
        'point-of-view shot',
        'over-the-shoulder shot',
        'profile shot',
        'three-quarter view shot',
        'rear view shot',
        'tracking shot',
        'dolly shot',
        'crane shot',
        'handheld shot',
        'static locked-off shot',
    ],
}

DEFAULT_CATEGORY_DESCRIPTIONS = {
    'lighting': 'Adjusts scene lighting style and mood.',
    'camera_type': 'Influences camera/lens capture character.',
    'frame': 'Controls framing and composition layout.',
    'shot': 'Sets subject distance and viewpoint angle.',
}


def _normalize_list(value):
    if not isinstance(value, list):
        return []
    result = []
    seen = set()
    for item in value:
        text = ''
        description = ''
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = str(item.get('value') or item.get('keyword') or item.get('text') or '').strip()
            description = str(item.get('description') or item.get('desc') or item.get('effect') or '').strip()
        else:
            continue
        if not text or text in seen:
            continue
        seen.add(text)
        result.append({'value': text, 'description': description})
    return result


def _normalize_descriptions(value):
    if not isinstance(value, dict):
        return {}
    result = {}
    for key, desc in value.items():
        if not isinstance(key, str):
            continue
        key_text = key.strip()
        if not key_text:
            continue
        desc_text = '' if desc is None else str(desc).strip()
        result[key_text] = desc_text
    return result


def _build_keyword_items(raw_values, descriptions, category):
    values = _normalize_list(raw_values)
    if not values:
        values = _normalize_list(DEFAULT_SDXL_KEYWORDS.get(category, []))

    description_map = _normalize_descriptions(descriptions)
    fallback = DEFAULT_CATEGORY_DESCRIPTIONS.get(category, '')

    for item in values:
        if not item.get('description'):
            item['description'] = description_map.get(item['value'], fallback)

    return values


def get_sdxl_keywords(reload=False):
    global sdxl_keywords
    if reload or not sdxl_keywords:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        config_file = os.path.join(current_dir, '../../sdxl_keywords.json')
        config_file = os.path.normpath(config_file)

        config_data = {}
        if os.path.exists(config_file):
            try:
                with open(config_file, 'r', encoding='utf8') as f:
                    config_data = json.load(f)
            except Exception:
                config_data = {}

        if not isinstance(config_data, dict):
            config_data = {}

        sdxl_keywords = {}
        sdxl_keywords['lighting'] = _build_keyword_items(
            config_data.get('lighting', DEFAULT_SDXL_KEYWORDS['lighting']),
            config_data.get('lighting_descriptions', {}),
            'lighting',
        )
        sdxl_keywords['camera_type'] = _build_keyword_items(
            config_data.get('camera_type', DEFAULT_SDXL_KEYWORDS['camera_type']),
            config_data.get('camera_type_descriptions', {}),
            'camera_type',
        )
        sdxl_keywords['frame'] = _build_keyword_items(
            config_data.get('frame', DEFAULT_SDXL_KEYWORDS['frame']),
            config_data.get('frame_descriptions', {}),
            'frame',
        )
        sdxl_keywords['shot'] = _build_keyword_items(
            config_data.get('shot', DEFAULT_SDXL_KEYWORDS['shot']),
            config_data.get('shot_descriptions', {}),
            'shot',
        )

    return sdxl_keywords