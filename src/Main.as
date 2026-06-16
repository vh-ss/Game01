package 
{
	import net.flashpunk.Engine;
	import net.flashpunk.FP;
	
	/**
	 * ...
	 * @author SunSeeker
	 */
	public class Main extends Engine 
	{
		public var olololo:String;
		
		public function Main():void 
		{
				
			//super(760, 600);
			super(760, 600);
			//FP.console.enable();
			
			
			//FP.screen.x = 26;
			//FP.screen.y = 50;
			
			//FP.screen.scale = 2;
			
		}
		
		override public function init():void 
		{
			FP.world = new GameWorld();
			
			super.init();
		}
		
	}
	
}