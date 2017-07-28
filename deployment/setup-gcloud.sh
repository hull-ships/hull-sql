#!/bin/bash
ENVSUFFIX=`echo $CIRCLE_BRANCH | tr /a-z/ /A-Z/`

GCLOUD_SERVICE_KEY="GCLOUD_SERVICE_KEY_$ENVSUFFIX"
GCLOUD_PROJECT="GCLOUD_PROJECT_$ENVSUFFIX"
GCLOUD_ZONE="GCLOUD_ZONE_$ENVSUFFIX"
GCLOUD_CLUSTER="GCLOUD_CLUSTER_$ENVSUFFIX"

echo "${!GCLOUD_SERVICE_KEY}" | base64 -d > ${HOME}/gcloud-service-key.json
gcloud auth activate-service-account --key-file ${HOME}/gcloud-service-key.json
gcloud container clusters get-credentials ${!GCLOUD_CLUSTER} \
  --zone ${!GCLOUD_ZONE} --project ${!GCLOUD_PROJECT}
