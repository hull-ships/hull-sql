#!/bin/bash

DOCKER_USER_DECODED=`echo $DOCKER_USER | base64 -d`
DOCKER_PASS_DECODED=`echo $DOCKER_PASS | base64 -d`
docker login -u $DOCKER_USER_DECODED -p $DOCKER_PASS_DECODED
docker -D push hull/hull-sql:$CIRCLE_SHA1
