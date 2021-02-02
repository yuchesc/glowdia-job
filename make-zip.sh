#!/usr/bin/env bash

rm -f glowdia-job.zip
mkdir glowdia-job

cp -Rp image js manifest.json glowdia-job/
cd glowdia-job/
zip -r glowdia-job.zip *
mv glowdia-job.zip ..

cd ..
rm -rf glowdia-job