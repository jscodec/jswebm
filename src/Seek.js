class Seek{
    
    constructor(seekHeader, dataInterface) {
        this.size = seekHeader.size;
        this.offset = seekHeader.offset;
        this.end = seekHeader.end;
        this.dataInterface = dataInterface;
        this.loaded = false;
        this.currentElement = null;
        this.seekId = -1;
        this.seekPosition = -1;
    }
    
    load(){

        while (this.dataInterface.offset < this.end) {
            if (!this.currentElement) {
                this.currentElement = this.dataInterface.peekElement();
                if (this.currentElement === null)
                    return null;
            }


            switch (this.currentElement.id) {

                case 0x53AB: //SeekId
                    var seekId = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (seekId !== null)
                        this.seekId = seekId;
                    else
                        return null;
                    break;

                case 0x53AC: //SeekPosition 
                    var seekPosition = this.dataInterface.readUnsignedInt(this.currentElement.size);
                    if (seekPosition !== null)
                        this.seekPosition = seekPosition;
                    else
                        return null;
                    break;
 
                default:
                    console.warn("Seek element not found, skipping");
                    break;

            }
            
            this.currentElement = null;
        }
        
        if(this.dataInterface.offset !== this.end)
            console.error("Invalid Seek Formatting");

        this.loaded = true;
    }
    
}


module.exports = Seek;