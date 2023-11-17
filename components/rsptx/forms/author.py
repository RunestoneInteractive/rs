from starlette_wtf import StarletteForm
from wtforms import (
    BooleanField,
    StringField,
    validators,
    DateField,
    HiddenField,
    SelectField,
    IntegerRangeField,
)


# Make a form for the library table
# Note: this could be easier -- we could automtically create a form from a sqlalchemy
# model, butthe bookserver owns the library model definition


class LibraryForm(StarletteForm):
    title = StringField("Title")
    subtitle = StringField("SubTitle")
    description = StringField("Description")
    authors = StringField("Authors")
    shelf_section = StringField(
        "Shelf Section",
        description="Look at the library page to see the existing list of sections.  Please try to use one of those.  Note do not add the Textbooks: to the end.",
    )
    basecourse = StringField("Base Course or Document ID")
    build_system = StringField("Build System", [validators.AnyOf(["PTX", "Runestone"])])
    for_classes = BooleanField("Available for courses")
    is_visible = BooleanField("Visible to Everyone in Library")
    github_url = StringField("Github URL")
    main_page = StringField("Main page")
    social_url = StringField("Social URL")
    # last_build = DateTimeField("Last Build") - no reason to update this manually


# Documentation on the Datashop format is here
# https://pslcdatashop.web.cmu.edu/help?page=importFormatTd


class DatashopForm(StarletteForm):
    basecourse = StringField("Base Course")
    with_assess = BooleanField("Only Courses with pre/post test")
    start_date = DateField("Select Courses with Start Dates After")
    end_date = DateField("Do not include data after")
    sample_size = IntegerRangeField("Number of courses to include")
    include_basecourse = BooleanField("Include data from the open course")
    specific_course = StringField("Create data shop file for this course")
    clist = HiddenField()


class DatashopInstForm(StarletteForm):
    preserve_user_ids = BooleanField("Preserve User IDs")
    specific_course = SelectField("Class Name")
    basecourse = HiddenField()
    clist = HiddenField()
