from locust import HttpUser, TaskSet, task, Locust
import bs4
import random
import sys, os


class WebsiteTasks(HttpUser):
    def on_start(self):
        res = self.client.get("/runestone/default/user/login")
        pq = bs4.BeautifulSoup(res.content)
        # Get the csrf key for successful submission
        i = pq.select('input[name="_formkey"]')
        token = i[0]["value"]
        # login a user
        try:
            user = "testuser1"
            pw = "xxx"
        except:
            print("ERROR please set RUNESTONE_TESTUSER and RUNESTONE_TESTPW ")
            sys.exit(-1)
        res = self.client.post(
            "/runestone/default/user/login",
            {"username": user, "password": pw, "_formkey": token, "_formname": "login"},
        )
        # Switch to fopp
        res = self.client.post("/runestone/default/coursechooser/fopp",
                               data={"course": "fopp"})

        # Get the index and make a list of all chapters/subchapters
        res = self.client.get("/ns/books/published/fopp/index.html")
        pq = bs4.BeautifulSoup(res.content, features="html.parser")
        pages = pq.select(".toctree-l2 a")
        print(f"Found {len(pages)} pages in the book")
        self.bookpages = [p["href"] for p in pages]
        print(f"Found {len(self.bookpages)} pages in the book")

    @task(5)
    def index(self):
        self.client.get("/runestone")

    @task(5)
    def course(self):
        self.client.get("/ns/course/index")

    @task(5)
    def doassign(self):
        self.client.get("/assignment/student/doAssignment?assignment_id=90")

    @task(20)
    def boookpage(self):
        # pick a page at random
        url = random.choice(self.bookpages)
        base = "/ns/books/published/fopp/"
        res = self.client.get(base + url)
        pq = bs4.BeautifulSoup(res.content)
        # client.get ONLY gets the html, so we need to simulate getting all
        # of the static assets ourselves.
        for s in pq.select("script"):
            if s.has_attr("src"):
                if s["src"].startswith(("http", "//")) == False:
                    js = self.client.get(
                        base + s["src"].replace("../", ""), name="scripts"
                    )
        for s in pq.select("link"):
            if s.has_attr("href"):
                if s["href"].startswith(("http", "//")) == False:
                    css = self.client.get(
                        base + s["href"].replace("../", ""), name="css"
                    )
        data = {
            "lastPageUrl": base + url,
            "lastPageScrollLocation": 0,
            "completionFlag": 0,
            "pageLoad": True,
            "markingComplete": False,
            "markingIncomplete": False,
            "course": "fopp",
            "isPtxBook": False,
        }
        self.client.post("/ns/logger/updatelastpage", json=data)
