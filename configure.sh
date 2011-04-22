#!/bin/sh
echo -n  "Activate AutoAttachment with Linshare: y or n? " 
read a
if [ $a = 'y' ]; then 
  echo -n "Size in KB from which the attachments are sent with Linshare? "
  read size
  echo -n "" >config.properties
  echo "extensions.linshare.autoAttachmentWithLinshare.active=true" >> config.properties
  echo "extensions.linshare.autoAttachmentMinimumInKB="$size >> config.properties
  echo "Done. Run build.sh for generating the extension"
else 
  echo -n "" >config.properties
  echo "extensions.linshare.autoAttachmentWithLinshare.active=false" >> config.properties
  echo "Done. Run build.sh for generating the extension"
fi

