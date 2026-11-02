"""Bounded visualization payload for an already calculated flame distribution."""
from math import fsum


def flame_histogram(distribution, bin_count=40):
    minimum, maximum = min(distribution), max(distribution)
    if minimum == maximum:
        return [{'lower': minimum, 'upper': maximum, 'probability': fsum(distribution.values())}]
    width = (maximum - minimum) / bin_count
    if width == 0:
        return [{'lower': minimum, 'upper': maximum, 'probability': fsum(distribution.values())}]
    buckets = [[] for _ in range(bin_count)]
    for score, probability in distribution.items():
        index = min(bin_count - 1, int((score - minimum) / width))
        buckets[index].append(probability)
    return [dict(lower=minimum + index * width,
                 upper=maximum if index == bin_count - 1 else minimum + (index + 1) * width,
                 probability=fsum(values)) for index, values in enumerate(buckets)]
