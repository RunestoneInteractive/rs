***************
LTI Integration
***************

Phase 1 (All LMS platforms)
===========================
Generate a shared/secret key pair for use with Canvas:

#.  Browse to the `Runestone Academy <https://runestone.academy>`_ and log in, then select your course (you must be the Instructor).
#.  Browse to the `Instructor's Page <https://runestone.academy/runestone/admin/admin>`_, then click on “LTI Integration” in the Admin tab.
#.  Click on the “Create LTI Key and Secret” button. Click the “Show Secret” button. You will use these in the next phase.

Phase 2 (LMS-specific Steps)
============================
Follow instructions for your LMS:

.. contents::
    :local:


Canvas
------
#.  Follow the `Canvas instructions <https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-configure-a-manual-entry-external-app-for-a-course/ta-p/1137>`_ to add an external app:

    :Name: Runestone
    :Consumer key: Enter this from Phase 1.
    :Shared Secret: Enter this from Phase 1.
    :Launch URL: ``https://runestone.academy/runestone/lti``
    :Domain: Leave blank.
    :Privacy: Select Public; otherwise, Runestone won’t work.
    :Custom Fields: Depends on the installation type:

        -   For a site-wide installation, or for installing the Runestone external app for use across multiple courses, leave this blank.
        -   If installing for a single course, add ``custom_course_id=xxx``, where ``xxx`` is the Runestone ID of the course (visible in the upper lefthand corner of each page in your Runestone course).
    :Description: Interactive textbooks from Runestone Academy

#.  Add an assignment in Canvas that uses the Runestone external tool:

    #.  At `Runestone Academy`_, create an assignment; be sure you’ve checked the “Visible to Students” box and saved that change.
    #.  Still on the assignments page, copy the LTI link.
    #.  In Canvas, add an assignment. For the submission type, select “External Tool.” For the External Tool URL, use the LTI link you just copied. You’ll have to manually enter the same due date/time and a similar assignment name; these aren’t copied automatically. You must be sure the Load This Tool In A New Tab checkbox is checked.

#.  Students can now click on this assignment and work it. **If they don’t click on the assignment, they won’t receive a grade.**
#.  When the assignment is due, go to Runestone directly from your Canvas course by using an assignment link. Otherwise, grade reporting won’t work.
#.  In the grading tab of the instructor interface, grade the assignment, then click the “Release Grades” button. Doing this will push all grades to Canvas.


Moodle
------
#. The following instructions are for Moodle, but should work for any LMS with LTI Support. Please note that certain items may have naming variations (ie. Moodle External Tool / Canvas External App).

#. In Moodle, create a new external tool called "LTI Login Link".

    :Name: Login to Runestone
    :Tool URL: https://runestone.academy/runestone/lti (this URL may be different for you; it is included at the bottom of the *Assignments* page inside the *Instructor's Page*)
    :Consumer key: Enter the key you copied for `consumer` from Phase 1
    :Shared secret: Enter the secret you copied for `secret` from Phase 1
    :Icon URL: https://runestone.academy/runestone/static/images/logo_small.png (this URL may be different; match the domain name to the URL used above in *Tool URL*)
    :Share Email: True
    :Share Name: True
    :Launch container: New Window (Runestone may not let your students log in if embedded into Moodle) 
    :Custom params:

#.  Login to your Runestone instance with the tool just created, and create your class as well as your assignments.

#.  For each new assignment, in Moodle create a new *External Tool*. You will also need the database values for your course ID (found in the top left corner next to the Runestone logo), and assignment ID (found at the bottom of the "Assignments" page inside the *Instructor's Page*). Please note that in order to receive roles and grades, "Accept Grades" must be checked in Moodle. In other LMS's this may be referenced by a "Share IMS Names and Roles" or similar. You will need to repeat this step for each new assignment. 

    :Name: Assignment 1
    :Tool URL: https://runestone.academy/runestone/lti?assignment_id=<assignment_id> (this URL is included at the bottom of the *Assignments* page inside the *Instructor's Page*)
    :Consumer key: Enter the key you copied for `consumer` from Phase 1
    :Shared secret: Enter the secret you copied for `secret` from Phase 1
    :Icon URL: https://runestone.academy/runestone/static/images/logo_small.png (this URL may be different; match the domain name to the URL used above in *Tool URL*)
    :Share Email: True
    :Share Name: True
    :Launch container: New Window (Runestone may not let your students log in if embedded into Moodle) 
    :Accept Grades: True
    :Custom params:


#.  Copy the tool as many times as you need within your Moodle Course, updating the Name and Tool URL each time.

#.  Students can now click on the Moodle assignment to be enrolled/logged directly into your Runestone course and assignment. The grades should appear in Moodle once they are released in Runestone through the Instructor's interface.

#.  The course instructor must also be an LTI sourced user, so use the "LTI Login Link" URL. This can be hidden for users.

Blackboard Learn Original or Ultra
------
#.  Follow the LTI instructions on help.blackboard.com for other LTI tools.  You can enable this integration by approving the domain in LTI tools, then creating placements (which puts menus under Build Content), or by using "Web Link" functionality in Original courses.  In Ultra courses LTI links can be added per course. `Blackboard information on LTI <https://help.blackboard.com/Learn/Administrator/SaaS/Integrations/Learning_Tools_Interoperability>`_   

#. Start by approving the LTI domain in the Admin panel of Blackboard Learn:

    :Admin setup: Approve runestone.academy as a domain in Admin -> LTI Tool Providers -> Register LTI 1.1 Provider
    :Course setup: In a course go to Build Content -> Web Link
    :Name: Runestone
    :Url: https://runestone.academy/runestone/lti
    :Check the box This link is to a Tool Provider: True (if you cannot, review the Admin step above to approve the domain)
    :LTI: Once the checkbox is selected, you will see additional fields: key, secret, Custom Parameters, Enable Evaluation
    :Key: Enter this from Phase 1.
    :Secret: Enter this from Phase 1.
    :Description: Interactive textbooks from Runestone Academy

#. Advanced setup

        -   For a site-wide installation, or for installing the Runestone external app for use across multiple courses, leave this blank.  You will enter key/secret in the Admin step above.
