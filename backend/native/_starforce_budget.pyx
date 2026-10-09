"""Same rounded budget recurrence as Python, with no Python work in its loop."""
from array import array

import cython


def budget_cdf(rounded, states, start, int bins):
    # Pack reachable states only. All buffers belong to this call; there is no
    # shared mutable state or cache, including while the GIL is released.
    if bins < 1 or bins > 65536:
        raise ValueError('Budget bins must be between 1 and 65536.')
    indices = {state: index for index, state in enumerate(states)}
    if not states or len(indices) != len(states) or len(states) > 30:
        raise ValueError('Expected 1 to 30 distinct reachable states.')
    cdef int start_index = indices[start]
    cdef int size = len(states)
    cdef int width = bins + 1
    storage = array('d', [0.0]) * (size * width)
    offsets = array('i', [0])
    destinations = array('i')
    probabilities = array('d')
    costs = array('i')
    for state in states:
        for destination, probability, cost in rounded[state]:
            if cost < 1:
                raise ValueError('Rounded costs must be positive.')
            destinations.append(indices[destination] * width if destination < len(rounded) else -1)
            probabilities.append(probability)
            # An edge beyond the horizon never contributes; avoid integer overflow.
            costs.append(min(cost, width))
        offsets.append(len(costs))
    cdef double[::1] values = storage
    cdef const int[::1] row_offsets = offsets
    cdef const int[::1] dest = destinations
    cdef const int[::1] lag = costs
    cdef const double[::1] prob = probabilities
    cdef int budget, state_index, edge, source, cost_bins
    cdef double total
    # Packing above establishes bounds, including strictly positive cost lags.
    # Preserve edge order and separate multiply/add for Python-equivalent doubles.
    with cython.boundscheck(False), cython.wraparound(False), nogil:
        for budget in range(1, width):
            for state_index in range(size):
                total = 0.0
                for edge in range(row_offsets[state_index], row_offsets[state_index + 1]):
                    cost_bins = lag[edge]
                    if cost_bins <= budget:
                        source = dest[edge]
                        if source < 0:
                            total += prob[edge] * 1.0
                        else:
                            total += prob[edge] * values[source + budget - cost_bins]
                values[state_index * width + budget] = 1.0 if total > 1.0 else total
    return storage[start_index * width:(start_index + 1) * width]
