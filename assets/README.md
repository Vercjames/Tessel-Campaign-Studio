# Asset library (mock storage)

Drop company logos, product shots and reference designs here. A brief refers to
them by bare filename. The bundled example brief uses these:

```yaml
brand:
  logo: tessel-logo.png
products:
  - name: Water Bottle
    description: Our member only matte black insulated bottle with a bamboo cap
    referenceImages: [modern-waterbottle.png]
  - name: Modern gym
    kind: composition
    description: Bright modern gym floor at golden hour
    referenceImages:
      - { file: modern-gym.png, roles: [background, atmosphere] }
```

Supported: `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, `.heif` (20 MB max each).
