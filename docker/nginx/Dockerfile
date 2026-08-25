FROM nginx:stable-alpine

RUN apk add --no-cache openssl

COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/gen-certs.sh /usr/local/bin/gen-certs.sh
RUN chmod +x /usr/local/bin/gen-certs.sh

EXPOSE 80 443

ENTRYPOINT ["/usr/local/bin/gen-certs.sh"]
CMD ["nginx", "-g", "daemon off;"]
