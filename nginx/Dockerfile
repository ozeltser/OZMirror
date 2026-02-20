FROM nginx:alpine

# envsubst is part of gettext; not included in nginx:alpine by default
RUN apk add --no-cache gettext

# Copy nginx config template (uses $API_KEY placeholder)
COPY nginx.conf /etc/nginx/templates/nginx.conf.template

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

# Use envsubst to inject API_KEY at container start, then launch nginx
CMD ["/bin/sh", "-c", "envsubst '${API_KEY}' < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
