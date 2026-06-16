package  
{
	import flash.display.BitmapData;
	import flash.display.MovieClip;
	import flash.geom.Point;
	import flash.text.TextField;
	import flash.text.TextFormat;
	import net.flashpunk.Entity;
	import net.flashpunk.graphics.Image;
	import net.flashpunk.FP;
	/**
	 * ...
	 * @author vadim
	 */
	public class TopPanel extends Entity 
	{
		[Embed(source = '../assets/graphics/top.png')] public const TOP_GRAPHIC:Class;
		
		public function TopPanel() 
		{
			graphic = new Image(TOP_GRAPHIC);
			x = FP.camera.x;
			y = FP.camera.y;
				
			   temp.x = 190;// FP.rand(760);
               temp.y = 10;// FP.rand(600);
			   temp.graphics.clear();
			   temp.graphics.lineStyle(2, 0x000000);
			   temp.graphics.moveTo(0, 0);
			   temp.graphics.lineTo(301, 0);
			   //temp.graphics.moveTo(300, 0);
			   temp.graphics.lineTo(300, 21);
			   temp.graphics.lineTo(0, 21);
			   temp.graphics.lineTo(0, 0);
               temp.graphics.beginFill(0x00FF40);
			   temp.graphics.drawRect(0, 0, 300, 20);
               temp.graphics.endFill();
				FP.stage.addChild(temp);
               
			format = new TextFormat('Calibri', 30, 0xffffff, true);
			lifesTextField.x = 90;
			lifesTextField.y = 0;
			lifesTextField.text = Assets.LIFES.toString();
			lifesTextField.textColor = 0xffffff;
			lifesTextField.setTextFormat(format, 0, Assets.LIFES.toString().length);
			FP.stage.addChild(lifesTextField);
			
			
			coinsTextField.x = 570;
			coinsTextField.y = 0;
			coinsTextField.text = Assets.TOTALCOINS.toString()+"/"+Assets.WINCOINS;
			coinsTextField.textColor = 0xffffff;
			coinsTextField.setTextFormat(format, 0, Assets.WINCOINS.toString().length+2 );
			FP.stage.addChild(coinsTextField);
			
		}
		
		var temp:MovieClip = new MovieClip(); 
		var h:Number = 100;
		var l:int = 3;
		var c:int = 0;
		var lifesTextField:TextField = new TextField();
		var coinsTextField:TextField = new TextField();
		var format: TextFormat;
            
		override public function update():void 
		{
			
			if (Assets.TOTALCOINS != c)
			{
				c = Assets.TOTALCOINS;
				
				coinsTextField.text = Assets.TOTALCOINS.toString()+"/"+Assets.WINCOINS;
			    coinsTextField.textColor = 0xffffff;
			    
				coinsTextField.setTextFormat(format, 0, Assets.TOTALCOINS.toString().length+Assets.WINCOINS.toString().length+1 );
			}
			
			
			if (Assets.HEALTH != h)
			{
			   h = Assets.HEALTH;
			   temp.x = 190;
               temp.y = 10;
			   temp.graphics.clear();
			   
			   temp.graphics.lineStyle(2, 0x000000);
			   temp.graphics.moveTo(0, 0);
			   temp.graphics.lineTo(300, 0);
			   temp.graphics.lineTo(300, 21);
			   temp.graphics.lineTo(0, 21);
			   temp.graphics.lineTo(0, 0);
			   temp.graphics.lineStyle(0, 0x000000);
			   if (h > 60)
			   	   temp.graphics.beginFill(0x00FF40);
			   if (h < 60&&h>30)
				   temp.graphics.beginFill(0xF8AA07);
			   if (h <= 30)
				   temp.graphics.beginFill(0xF21E0D);
			   
              
			   temp.graphics.drawRect(0, 0, h*3, 20);
               temp.graphics.endFill();
				FP.stage.addChild(temp);
				
			}
			else
			{
			
			}
			//FP.stage.removeChild(temp);
			
			x = FP.camera.x;
			y = FP.camera.y;
			super.update();
		}
		
	}

}