PATCH PMB GELOMBANG II TA 2027/2028 + SEO GOOGLE
================================================
Salin ke folder proyek (struktur sama), timpa file lama:

  views/landing/pmb.ejs                         TIMPA  (halaman PMB + JSON-LD + FAQ)
  views/landing/pmb_success.ejs                 TIMPA
  views/landing/index.ejs                       TIMPA
  views/partials/header-landing.ejs             TIMPA  (og:url, twitter card, keywords, locale)
  routes/landing.js                             TIMPA  (meta SEO /pmb; halaman sukses noindex)
  app.js                                        TIMPA  (/pmb masuk sitemap.xml; robots: Disallow /pmb/submit)
  public/images/pmb-gelombang2-2027-2028.jpg    BARU   (flyer, juga jadi gambar pratinjau share)

Restart server, lalu:
  1. Cek https://elektronika.polidewa.ac.id/sitemap.xml  -> harus ada /pmb
  2. Google Search Console -> Inspeksi URL -> /pmb -> "Minta pengindeksan"
  3. Search Console -> Sitemap -> kirim sitemap.xml (jika belum)
  4. Uji: search.google.com/test/rich-results  (FAQ, breadcrumb)
