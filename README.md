# World Time Converter

World Time Converter is a simple Node.js + Express web application that helps users check and convert time across different time zones. It provides REST API endpoints to:

Detect your current location (/api/whereami)

Search available timezones (/api/timezones?q=...)

Convert time between zones (/api/convert)

This makes it useful for students, remote teams, or anyone who needs to quickly compare times across countries without manually calculating offsets.

The app uses Express as a backend server and can be extended with APIs like WorldTimeAPI or GeoIP for richer functionality.
