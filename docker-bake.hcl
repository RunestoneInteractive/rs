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
    "rs-admin"
  ]
}

target "rs-jobe" {
    context    = "./projects/jobe"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-jobe:latest"]
    push       = true
}

target "rs-book" {
    context    = "./projects/book_server"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-book:latest"]
    push       = true
}

target "rs-runestone" {
    context    = "./projects/w2p_login_assign_grade"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-runestone:latest"]
    push       = true
}

target "rs-assignment" {
    context    = "./projects/assignment_server"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-assignment:latest"]
    push       = true
}

target "rs-nginx" {
    context    = "./"
    dockerfile = "projects/nginx/Dockerfile"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-nginx:latest"]
    push       = true
}

target "rs-nginx-dstart-dev" {
    context    = "./"
    dockerfile = "projects/nginx_dstart_dev/Dockerfile"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-nginx-dstart-dev:latest"]
    push       = true
}

target "rs-rsmanage" {
    context    = "./projects/rsmanage"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-rsmanage:latest"]
    push       = true
}

target "rs-author" {
    context    = "./projects/author_server"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-author:latest"]
    push       = true
}

target "rs-worker" {
    context    = "./projects/author_server"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-worker:latest"]
    push       = true
}

target "rs-admin" {
    context    = "./projects/admin_server"
    dockerfile = "Dockerfile"
    platforms  = ["linux/amd64", "linux/arm64"]
    tags       = ["ghcr.io/runestoneinteractive/rs-admin:latest"]
    push       = true
}