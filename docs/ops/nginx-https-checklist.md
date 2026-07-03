# Nginx HTTPS Checklist

Config path:

```text
/www/server/panel/vhost/nginx/agrios.xyzwtt.com.conf
```

Before reload:

```bash
sudo nginx -t
```

Reload only after a successful test:

```bash
sudo nginx -s reload
```

Mobile routes must preserve the desktop site:

```nginx
location = /mobile {
    return 301 /mobile/;
}

location ^~ /mobile/ {
    try_files $uri $uri/ /mobile/index.html;
}
```

Validation:

```bash
curl -I https://agrios.xyzwtt.com/
curl -I https://agrios.xyzwtt.com/mobile/
curl -I https://agrios.xyzwtt.com/mobile/login
```

Do not replace the desktop root `index.html` or root `assets` directory while publishing mobile.
