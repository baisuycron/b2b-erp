# Image Search Upgrade Note

The built-in lightweight embedding model is `b2b-visual-signature-v2`.
It extracts decoded image-pixel features instead of raw file-byte signatures.
Qdrant payloads include `embeddingModel`, and image search filters by the
configured model name to avoid mixing old vectors with new vectors.

After upgrading from the old byte-signature model, rebuild vectors once:

```powershell
curl -X POST "http://127.0.0.1:8080/api/admin/products/images/rebuild-vector?limit=500&full=true"
```

The default minimum image-search score is `0.72`. Override it with
`IMAGE_SEARCH_MINIMUM_SCORE` only after checking real product images.
