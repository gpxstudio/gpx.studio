FROM node:alpine3.23

RUN apk update && apk add --no-cache git
RUN git clone https://github.com/gpxstudio/gpx.studio.git && \
      cd gpx.studio/gpx && \
      npm install && \
      npm run build
