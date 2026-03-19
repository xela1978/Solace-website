# `font-awesome.min.css`

Derived from [Font Awesome Free 6.5.1](https://fontawesome.com) (cdnjs). Changes from upstream `all.min.css`:

- `font-display:block` → `font-display:swap` (FCP / Lighthouse)
- `url(../webfonts/...)` → absolute URLs on cdnjs (so paths work when CSS is served from this site)

Regenerate:

```bash
python -c "import urllib.request; u='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'; b='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/webfonts/'; c=urllib.request.urlopen(u).read().decode(); c=c.replace('url(../webfonts/', 'url('+b).replace('font-display:block','font-display:swap'); open('css/font-awesome.min.css','w',encoding='utf-8').write(c)"
```
