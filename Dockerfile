FROM node:12.20-alpine

WORKDIR /app

COPY ./package.json /app/package.json
COPY ./yarn.lock /app/yarn.lock

RUN yarn --ignore-scripts --ignore-engines
COPY . /app
RUN yarn --ignore-engines

# RUN yarn --ignore-scripts



# RUN yarn run build

ENTRYPOINT node -r newrelic build
