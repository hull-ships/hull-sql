FROM node:8.10

WORKDIR /app

COPY ./package.json /app/package.json
COPY ./yarn.lock /app/yarn.lock

RUN yarn --ignore-scripts
COPY . /app
RUN yarn

# RUN yarn --ignore-scripts



# RUN yarn run build

ENTRYPOINT node -r newrelic build
