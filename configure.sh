#!/bin/sh
target="content/config.properties"
echo -n  "Activate AutoAttachment with Linshare: y or n? " 
read a
if [ $a = 'y' ]; then 
  echo -n "Size in KB from which the attachments are sent with Linshare? "
  read size
  echo -n "" > $target
  echo "extensions.linshare.autoAttachmentWithLinshare.active=true" >> $target
  echo "extensions.linshare.autoAttachmentMinimumInKB="$size >> $target
  echo "Done. Run build.sh for generating the extension"
else 
  echo -n "" >$target
  echo "extensions.linshare.autoAttachmentWithLinshare.active=false" >> $target
  echo "Done. Run build.sh for generating the extension"
fi
