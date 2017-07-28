#!/bin/bash
docker login -u $DOCKER_USER -p $DOCKER_PASS
docker -D push hull/hull-sql:$CIRCLE_SHA1
