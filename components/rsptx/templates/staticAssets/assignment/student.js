/*
 * This file is part of Runestone Academy
 * This is javascript to support the assignment/student.py its pages and endpoints
 * Copyright (C) 2023 by Runestone Academy LTD
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 */

async function updateAssignmentProgress(newState, assignmentId) {
    let data = {
        assignment_id: assignmentId,
        new_state: newState,
    };
    let jsheaders = new Headers({
        "Content-type": "application/json; charset=utf-8",
        Accept: "application/json",
    });
    let request = new Request(`/assignment/student/update_submit`, {
        method: "POST",
        headers: jsheaders,
        body: JSON.stringify(data),
    });
    let resp = await fetch(request);
    if (!resp.ok) {
        alert(`Status Not Updated ${resp.statusText}`);
    } else {
        if (location.href.indexOf("doAssignment") > -1) {
            window.location.reload(true);
        }
    }

    console.log(newState);
}
