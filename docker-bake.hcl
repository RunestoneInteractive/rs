# This file allows you to build and push all the Runestone Interactive Docker images using Docker Bake.
# To use this file, you need to have Docker installed with BuildKit enabled.
# You can run the following command to build and push all images defined in this file:
# docker buildx bake --file docker-bake.hcl --push Or just docker buildx bake --push
# you may need to run `docker buildx create --use` first to set up a buildx builder.
# individual targets can be built with:
# docker buildx bake --file docker-bake.hcl rs-jobe
# docker buildx bake --file docker-bake.hcl rs-book
# docker buildx bake --file docker-bake.hcl rs-runestone
# docker buildx bake --file docker-bake.hcl rs-assignment
# docker buildx bake --file docker-bake.hcl rs-nginx
# docker buildx bake --file docker-bake.hcl rs-nginx-dstart-dev
# docker buildx bake --file docker-bake.hcl rs-rsmanage
# docker buildx bake --file docker-bake.hcl rs-author
# docker buildx bake --file docker-bake.hcl rs-worker
# docker buildx bake --file docker-bake.hcl rs-admin

# Note that bake does not leave the images locally, it only pushes them to the registry.
# You still need to pull or build them locally the old way during development.

variable "VERSION" {
    default = "8.0.3"
}

group "default" {
    targets = [
    "rs-jobe",
    "rs-book",
    "rs-runestone",
    "rs-assignment",
    "rs-nginx",
    "rs-nginx-dstart-dev",
    "rs-rsmanage",
    "rs-author",
    "rs-worker",
    "rs-admin",
  ]
}

target "rs-jobe" {
    context    = "./projects/jobe"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-jobe:latest", "ghcr.io/runestoneinteractive/rs-jobe:${VERSION}"]
    push       = true
}

target "rs-book" {
    context    = "./projects/book_server"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-book:latest", "ghcr.io/runestoneinteractive/rs-book:${VERSION}"]
    push       = true
}

target "rs-runestone" {
    context    = "./projects/w2p_login_assign_grade"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-runestone:latest", "ghcr.io/runestoneinteractive/rs-runestone:${VERSION}"]
    push       = true
}

target "rs-assignment" {
    context    = "./projects/assignment_server"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-assignment:latest", "ghcr.io/runestoneinteractive/rs-assignment:${VERSION}"]
    push       = true
}

target "rs-nginx" {
    context    = "./"
    dockerfile = "projects/nginx/Dockerfile"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-nginx:latest", "ghcr.io/runestoneinteractive/rs-nginx:${VERSION}"]
    push       = true
}

target "rs-nginx-dstart-dev" {
    context    = "./"
    dockerfile = "projects/nginx_dstart_dev/Dockerfile"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-nginx-dstart-dev:latest", "ghcr.io/runestoneinteractive/rs-nginx-dstart-dev:${VERSION}"]
    push       = true
}

target "rs-rsmanage" {
    context    = "./projects/rsmanage"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-rsmanage:latest", "ghcr.io/runestoneinteractive/rs-rsmanage:${VERSION}"]
    push       = true
}

target "rs-author" {
    context    = "./projects/author_server"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-author:latest", "ghcr.io/runestoneinteractive/rs-author:${VERSION}"]
    push       = true
}

target "rs-worker" {
    context    = "./projects/author_server"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-worker:latest", "ghcr.io/runestoneinteractive/rs-worker:${VERSION}"]
    push       = true
}

target "rs-admin" {
    context    = "./projects/admin_server"
    dockerfile = "Dockerfile"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-admin:latest", "ghcr.io/runestoneinteractive/rs-admin:${VERSION}"]
    push       = true
}

target "latex_base" {
    context    = "./projects/latex_image"
    dockerfile = "Dockerfile"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/latex_base:important"]
    push       = true
}