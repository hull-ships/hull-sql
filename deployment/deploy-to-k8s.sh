#!/bin/bash
ENVSUFFIX=`echo $CIRCLE_BRANCH | tr /a-z/ /A-Z/`
K8S_NAMESPACE_VAR="K8S_NAMESPACE_$ENVSUFFIX"
export K8S_NAMESPACE="${!K8S_NAMESPACE_VAR}"

export GOOGLE_APPLICATION_CREDENTIALS=${HOME}/gcloud-service-key.json
cat kubernetes.yml | envsubst | kubectl apply -f -
