FROM nginx:alpine
COPY crazy-tower.html /usr/share/nginx/html/index.html
EXPOSE 80
