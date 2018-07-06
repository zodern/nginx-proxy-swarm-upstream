VERSION="0.1.0"
NAME="zodern/nginx-proxy-swarm-upstream"

docker build -t $NAME .
docker tag $NAME $NAME:latest
docker tag $NAME $NAME:$VERSION

echo "will push $VERSION in 30 seconds"
sleep 30

docker push $NAME:latest
docker push $NAME:$VERSION
