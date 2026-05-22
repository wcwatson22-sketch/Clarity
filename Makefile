IMAGE_TAG ?= latest
REGISTRY  ?= localhost

.PHONY: dev build push deploy clean

## Local development (hot reload)
dev:
	dotnet run --project backend/Clarity.Api & \
	cd frontend && npm start

## Build Docker images
build:
	docker build -t $(REGISTRY)/clarity-api:$(IMAGE_TAG) ./backend
	docker build -t $(REGISTRY)/clarity-frontend:$(IMAGE_TAG) ./frontend

## Push images to registry
push:
	docker push $(REGISTRY)/clarity-api:$(IMAGE_TAG)
	docker push $(REGISTRY)/clarity-frontend:$(IMAGE_TAG)

## Compose up (local docker)
up:
	docker compose up --build -d

down:
	docker compose down

## Apply all K8s manifests
deploy:
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/backend/
	kubectl apply -f k8s/frontend/
	kubectl apply -f k8s/ingress.yaml

## Tear down K8s resources
undeploy:
	kubectl delete -f k8s/ --recursive --ignore-not-found

## Watch pods
watch:
	kubectl get pods -n clarity -w

clean:
	docker compose down --rmi local --volumes
