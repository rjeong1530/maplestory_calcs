"""Build the small Star Force kernel during installation, never on requests."""
import sys

from Cython.Build import cythonize
from setuptools import Extension, setup


setup(
    name='maplestory-starforce-kernel',
    version='1.0.0',
    ext_modules=cythonize(
        [Extension('_starforce_budget', ['_starforce_budget.pyx'],
                   extra_compile_args=['/fp:strict'] if sys.platform == 'win32'
                   else ['-ffp-contract=off'])],
        compiler_directives={'language_level': 3},
    ),
)
