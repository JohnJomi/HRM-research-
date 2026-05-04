#!/usr/bin/env python3
import os
import numpy as np
import json

ROOT = os.path.dirname(os.path.dirname(__file__))
OUT = os.path.join(ROOT, "data", "arc-2-aug-1000")
seq_len = 30 * 30
vocab_size = 12

os.makedirs(OUT, exist_ok=True)

# Helper to write a split
def make_split(split_name, num_puzzles, examples_per_puzzle):
    split_dir = os.path.join(OUT, split_name)
    os.makedirs(split_dir, exist_ok=True)

    total_examples = num_puzzles * examples_per_puzzle
    inputs = np.random.randint(0, vocab_size, size=(total_examples, seq_len), dtype=np.uint8)
    labels = np.random.randint(0, vocab_size, size=(total_examples, seq_len), dtype=np.int32)

    # puzzle_indices: cumulative example counts
    puzzle_indices = [0]
    for i in range(num_puzzles):
        puzzle_indices.append(puzzle_indices[-1] + examples_per_puzzle)
    puzzle_indices = np.array(puzzle_indices, dtype=np.int32)

    # puzzle_identifiers: assign an identifier for each puzzle (1..num_puzzles)
    # Reserve 0 for <blank>
    puzzle_identifiers = np.arange(1, num_puzzles + 1, dtype=np.int32)

    # group_indices: single group containing all puzzles
    group_indices = np.array([0, num_puzzles], dtype=np.int32)

    # Save arrays
    set_name = "all"
    np.save(os.path.join(split_dir, f"{set_name}__inputs.npy"), inputs)
    np.save(os.path.join(split_dir, f"{set_name}__labels.npy"), labels)
    np.save(os.path.join(split_dir, f"{set_name}__puzzle_identifiers.npy"), puzzle_identifiers)
    np.save(os.path.join(split_dir, f"{set_name}__puzzle_indices.npy"), puzzle_indices)
    np.save(os.path.join(split_dir, f"{set_name}__group_indices.npy"), group_indices)

    return total_examples, num_puzzles

# Create train (10 examples) and test (30 examples)
train_examples, train_puzzles = make_split("train", num_puzzles=5, examples_per_puzzle=2)  # 10 examples
test_examples, test_puzzles = make_split("test", num_puzzles=10, examples_per_puzzle=3)   # 30 examples

# Write identifiers.json
num_identifiers = max(train_puzzles, test_puzzles) + 1  # include blank id 0
identifiers = ["<blank>"] + [f"puzzle_{i}" for i in range(1, num_identifiers)]
with open(os.path.join(OUT, "identifiers.json"), "w") as f:
    json.dump(identifiers, f)

# Metadata
from dataset.common import PuzzleDatasetMetadata
metadata_train = PuzzleDatasetMetadata(
    pad_id=0,
    ignore_label_id=0,
    blank_identifier_id=0,
    vocab_size=vocab_size,
    seq_len=seq_len,
    num_puzzle_identifiers=num_identifiers,
    total_groups=1,
    mean_puzzle_examples=2.0,
    sets=["all"]
)
with open(os.path.join(OUT, "train", "dataset.json"), "w") as f:
    json.dump(metadata_train.model_dump(), f)

metadata_test = PuzzleDatasetMetadata(
    pad_id=0,
    ignore_label_id=0,
    blank_identifier_id=0,
    vocab_size=vocab_size,
    seq_len=seq_len,
    num_puzzle_identifiers=num_identifiers,
    total_groups=1,
    mean_puzzle_examples=3.0,
    sets=["all"]
)
with open(os.path.join(OUT, "test", "dataset.json"), "w") as f:
    json.dump(metadata_test.model_dump(), f)

print(f"Wrote dataset: {OUT}")
print(f"train examples: {train_examples}, test examples: {test_examples}")
