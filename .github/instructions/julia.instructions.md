---
description: 'Guidelines for writing Julia code in the project.'
applyTo: 'projects/*/**.jl'
---

# Julia Guidelines

## Plotting

Use `Makie.jl` for plotting.
Backends such as `GLMakie` or `CairoMakie` are fine, but `WGLMakie` should be avoided since it can produce different results on different platforms.
