FROM node

WORKDIR /app

# COPY ./package.json /app/package.json
# COPY ./yarn.lock /app/yarn.lock

# RUN node --version

COPY . /app
RUN yarn --ignore-scripts
RUN yarn run build

ENTRYPOINT npm start
