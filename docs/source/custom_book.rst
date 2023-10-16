Customizing a Textbook on Runestone Academy
===========================================

This is a guide for customizing a textbook on Runestone Academy.  It is intended for instructors who are using Runestone Academy to host their course materials, but who want to make some changes to the textbook.  For example, you might want to add a new chapter, or add some new exercises to an existing chapter.

First, I'm going to try to discourage you from going any further.   Someday we hope to make customizing Runestone books very easy.  Today it requires facility with github and writing in PreTeXt and maybe a few other skills.  The most common reasons I hear from teachers for wanting to customize there books are:

1. I want to hide some materials from my students.  **Why??**  Why would you prevent your students from reading ahead or learning extra materials?  If you have a curious and motivated student why hold them back?  They can always find the material in the "open course" that uses the same book anyway.
2. I want to rearrange the order of some chapters.  This is much easier said than done.  Any textbook author will tell you that the order of the chapters is a very carefully thought out process.  With each chapter building on the chapters before it.  Simply moving chapters around without doing significant rewriting is going to lead to a very frustrating experience for your students.
3. I want to add additional exercises.  This is a great thing to do, but is already supported through our web interface.  See the `Instructor guide <https://guide.runestone.academy>` for more information.

The last thing I will say to discourage you is that if you do customize your book, you will need to maintain it.  If you are using a book that is maintained by someone else, then you can benefit from their work.  If you customize your book, then you will need to keep up with any changes that are made to the original book.  This is not a trivial task.   It also takes additional resources on Runestone academy for every additional book.  Hosting a book that is only being used by one class is not a great use of our resources, and it takes up some time from our staff (me) to help you get your book set up.

If you are still reading, then I will assume that you have a good reason for wanting to customize your book.  I will also assume that you have some familiarity with github and PreTeXt.  If you don't, then you should probably stop here and go learn about those things first.

There are some good reasons to want to customize a book.  

1. I want to provide more culturally relevant examples.  This is a great reason to customize a book.  If you want to add some examples that are more relevant to your students, then you should do that.  You can even contribute those changes back to the original book so that others can benefit from your work.
2. I want to add an additional chapter that covers new material not covered in the book.  This is also a great reason to customize a book.  You can add a new chapter, and then add links to that chapter from the existing chapters.  You can even contribute that chapter back to the original book so that others can benefit from your work.
3. I have a better way of explaining something than the original author.  Great, you can change the text to make it better.  But before you go to all the work of a custom book it might be a good idea to engage the original author in a discussion about your ideas.  They might be able to incorporate your ideas into the original book, and then everyone benefits.  Authors who write Open Source textbooks are usually very open to suggestions and improvements.


Getting Started
---------------

1. Create a fork of the book you want to customize.  Most of the books on Runestone Academy have Forks from our RunestoneInteractive organization.  For some others the repositories are easy to find if you look at the book, or just do a github search
2. Create an issue on `Github, here <https://github.com/RunestoneInteractive/rs>`_ to let me know you are working on a custom book.  Please include the name of the book and the document-id. This will allow me to be sure that the document-id is not already in use.
4. Clone your fork to your local machine.  You will need to have git installed on your machine. 
5. Make your changes.
6. Commit your changes and push them back to github.
7. Make sure you consult the section in the `PreTeXt Guide <https://pretextbook.org/doc/guide/html/sec-publishing-to-runestone-academy.html>`_ on publishing to Runestone Academy.
8. Update the issue to let me know you are ready to publish.  I will then add your book to Runestone Academy, and set you up as an author so that you can publish changes directly to Runestone Academy.

