
[![Build Status](https://travis-ci.org/softbrix/vega_media_info.svg?branch=master)](https://travis-ci.org/softbrix/vega_media_info)

# Vega Media info

The Vega Media info is a utility project to consolidate the information stored in media files.
The information might be stored in an EXIF or IPTC block and is structured in different ways.
The response from this tool will always be in the in the same format to simplify meta
information extraction and inserts.


# Returned information
Calling the readMediaInfo method will return the following information about a file:

{
  CreateDate: '2003-12-14T11:42:20.000Z',
  ModifyDate: '2003-12-14T11:42:20.000Z',
  Width: 2272,
  Height: 1704,
  Regions: [Face/Focus region information],
  Tags: [Image keywords and tags from different meta containers],
  Type: 'exifImage',
  Raw: [Full file meta info]
}
## Tags

This utility provides CRD methods to update the tags in a media file.

- addTag - Add a new tag to a file
- removeTag - Remove a tag from a file
- getTags - Return a list with tags for a file

## External dependencies

The following dependencies are needed to be able to update the meta information

#### Exiftool

To read exif info from images.

### Install the external dependencies

### Mac OS X:

sudo brew update  
sudo brew install exiftool

### Ubuntu:

sudo apt-get update  
sudo apt-get install libimage-exiftool-perl

# Going native

The exiftool is a great tool for extracting and updating the meta information in
media files. But calling a third party tool from javascript is not best practice
and quite sub optimal.
But from version 1.3.0 the read operations are all native javascript.
The image buffer is loaded once and there are a couple different tools responsible
for extracting different parts of the meta information.
The exiftool is only called when the media file is not recognized or when updating the meta information.

# Why Vega
I am raised in an neighborhood close to Stockholm called Vega. This neighborhood
is named after a Swedish exploratory ship which aimed to sail to the north pole.
A nickname I got when I was little was 'Vega Mega'. This name popped up in my head
when I needed this utility.
