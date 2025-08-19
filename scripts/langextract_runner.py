
import json
import sys
import os
from typing import Dict, List, Any
import argparse

try:
    import langextract as lx
except ImportError:
    print(json.dumps({"error": "langextract not installed. Please install with: pip install langextract"}))
    sys.exit(1)

def run_extraction(config: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # Prepare examples
        examples = []
        for example in config["examples"]:
            extractions = []
            for ext in example["extractions"]:
                extractions.append(lx.data.Extraction(
                    extraction_class=ext["extraction_class"],
                    extraction_text=ext["extraction_text"],
                    attributes=ext["attributes"]
                ))
            examples.append(lx.data.ExampleData(
                text=example["text"],
                extractions=extractions
            ))

        # Get API key from environment or config
        api_key = config.get("api_key") or os.getenv("LANGEXTRACT_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
        
        # Run extraction
        result = lx.extract(
            text_or_documents=config["text"],
            prompt_description=config["prompt_description"],
            examples=examples,
            model_id=config["model_id"],
            extraction_passes=config.get("extraction_passes", 1),
            max_workers=config.get("max_workers", 5),
            api_key=api_key
        )

        # Process results
        extractions = []
        if hasattr(result, 'extractions'):
            for extraction in result.extractions:
                extractions.append({
                    "extraction_class": extraction.extraction_class,
                    "extraction_text": extraction.extraction_text,
                    "attributes": extraction.attributes,
                    "position_start": getattr(extraction, 'position_start', None),
                    "position_end": getattr(extraction, 'position_end', None),
                    "confidence": getattr(extraction, 'confidence', None)
                })

        # Calculate metadata
        unique_classes = len(set(ext["extraction_class"] for ext in extractions))
        confidences = [ext.get("confidence", 1.0) for ext in extractions if ext.get("confidence") is not None]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return {
            "success": True,
            "extractions": extractions,
            "metadata": {
                "total_extractions": len(extractions),
                "unique_classes": unique_classes,
                "average_confidence": avg_confidence
            }
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="JSON config file path")
    args = parser.parse_args()

    try:
        with open(args.config, 'r') as f:
            config = json.load(f)
        
        result = run_extraction(config)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
